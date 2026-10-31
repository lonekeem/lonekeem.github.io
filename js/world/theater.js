// 🎬 Lone Keem Studio: the movie theater controller (lazy: theater-gate.js imports this only near the theater).
// Outside = a big lit building, marquee, sign and a painted parking lot (no colliders on the lot, so cars park freely).
// Inside = a hidden room (like the houses): lobby with snack + ticket counters and staff, then a red stadium auditorium.
// Presence inside reuses the house presence channel (houseHere/h990), sitting reuses P.sit, snacks are Star Coins only
// (the normal Pal Shop path). One shared doc theater/lone-keem-studio holds colors, decor, lights and the screen; only the
// admin / ∞ Pass (isUnlimited, the same unlimitedFor() path in firestore.rules) can write it.
import { THEATER, FLAT, roomState, poleClear } from './layout.js';
import { buildCar, poseCar, CARS } from './cars.js';
import { SURF, DEF, hexOk, parseT, serT, makeKit, buildExterior, buildInterior, IN, setMovieArt, artMeshes, loadExtPosters } from './theater-build.js';
import { THEATER_SONGS } from './theater-songs.js';
import { drawLyrics } from './tvlyrics.js';
import { isUnlimited } from '../inf-pass.js';
import { doc, onSnapshot, setDoc, serverTimestamp } from '../fsq.js';
import { startHouseParty } from './housemates.js';
import { attachTheaterNpcs } from './theater-npcs.js';
import { createTheaterHush } from './theater-hush.js';
import { FILMS, MOVIE, TC, familyOnly, creditFilms, CARD, licDeed, licName, bareUrl, SHERIFF_SLOT, SHERIFF_FAMILY, boardFooter, showAt, listings, anchorFor, program, slotTitle, runtime, createMoviePlayer, drawMovieScreen, drawNowShowing, drawBoard, clockStr, mmss } from './theater-movie.js';
import { sheriffOk } from '../sheriff-age.js';

const TID = 'lone-keem-studio', LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const EMO = { '👋': 'wave', '🎉': 'groove', '😂': 'bounce', '⭐': 'twirl', '💜': 'happyshimmy' };
// default decor (house item grammar, local coords). Lobby: padded wall benches, cafe sets, round ottoman, planters.
const DEF_LI = [
  ['xb', -15.25, 14, 1, '#800020', { f: '#d4af37' }], ['xb', -15.25, 18.6, 1, '#800020', { f: '#d4af37' }], ['xb', 15.25, 14, 3, '#800020', { f: '#d4af37' }], ['xb', 15.25, 18.6, 3, '#800020', { f: '#d4af37' }],
  ['xt', -10, 15.5, 0, '', { f: '#f3e3c3' }], ['xc', -10, 14.6, 0, '#800020', { f: '#d4af37' }], ['xc', -10, 16.4, 2, '#800020', { f: '#d4af37' }],
  ['xt', -5.5, 18.5, 0, '', { f: '#f3e3c3' }], ['xc', -5.5, 17.6, 0, '#800020', { f: '#d4af37' }], ['xc', -5.5, 19.4, 2, '#800020', { f: '#d4af37' }],
  ['xt', 10, 15.5, 0, '', { f: '#f3e3c3' }], ['xc', 10, 14.6, 0, '#800020', { f: '#d4af37' }], ['xc', 10, 16.4, 2, '#800020', { f: '#d4af37' }],
  ['xo', 0, 15, 0, '#a3191f', { f: '#d4af37' }], ['xp', -14.9, 21, 0, '', { f: '#2a1416' }], ['xp', 14.9, 21, 0, '', { f: '#2a1416' }], ['xs', -4.6, 7.2, 0, '', {}]
].map(([c, x, z, r, col, parts]) => ({ c, x, z, r, col, parts }));
// outside (relative to the plaza in front of the doors): lamps, planters, benches, velvet ropes
const DEF_LO = [
  ['xl', 1.5, -13, 0], ['xl', 1.5, 13, 0], ['xl', 1.5, -21, 0], ['xl', 1.5, 21, 0], ['xp', 0.9, -16, 0], ['xp', 0.9, 16, 0],
  ['xn', 0.9, -18.6, 1], ['xn', 0.9, 18.6, 1], ['xr', 2.6, -3.4, 1], ['xr', 2.6, 3.4, 1]
].map(([c, x, z, r]) => ({ c, x, z, r, col: c === 'xn' ? '#800020' : c === 'xr' ? '#800020' : '', parts: c === 'xp' ? { f: '#2a1416' } : {} }));

export function attachTheater(api, W, K, { far }) {
  const { THREE, P, S, db, LOW } = api; const T = THEATER; const uid = S.user && S.user.uid;
  const RX = T.room.x, RZ = T.room.z, OX = T.x1 + 2, OZ = T.door[1]; // hidden room centre + outdoor decor origin
  const kit = makeKit(THREE); const cleanup = [];
  // The Sheriff is 13+ (trusted age, js/safety.js viewerAge): under-13 / unknown-age players get the family program
  // locally (same clock, same slots, nothing written). The feature poster follows it (facade + lobby frame).
  // While SHERIFF_IN_THEATER (theater-movie.js) is off, everyone gets that family view.
  const kid = () => familyOnly(!sheriffOk()); let artKid = kid(); const artUrl = (k) => (k ? FILMS[SHERIFF_FAMILY[0]].poster : FILMS.sheriff.poster);
  artMeshes.length = 0; setMovieArt(artUrl(artKid));
  function swapArt() { const k = kid(); if (k === artKid) return; artKid = k; const url = artUrl(k); setMovieArt(url); const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.userData.src = url;
    const old = new Set(); for (const m of artMeshes) { if (m.material.map) old.add(m.material.map); m.material.map = t; m.material.needsUpdate = true; } for (const o of old) o.dispose(); for (const p of [...(ib ? ib.lobbyPosters : []), ...(ex ? ex.extPosters : [])]) p.key = ''; nsT = 0; bdT = 0; extT = 0; }
  // ---------------------------------------------------------------- outside
  const extG = new THREE.Group(); extG.name = 'theater-ext'; W.root.add(extG);
  const ex = buildExterior(THREE, kit, extG, T, FLAT, LOW); if (far) far.visible = false;
  for (const c of ex.cols) api.cyl.push(c);
  // a few guests' cars already parked in the painted stalls (lite models, 2 small colliders each, plenty of stalls left free)
  const carG = new THREE.Group(); carG.name = 'theater-cars'; extG.add(carG);
  try { const pick = ex.stalls.filter((_, i) => i % 3 === 1).slice(0, LOW ? 4 : 9); pick.forEach((st0, i) => { const d = CARS[(i * 5 + 1) % CARS.length]; const m = buildCar(d, (i * 7 + 3) % 12, { lite: true, noShadow: true }); poseCar(m, { x: st0.x, y: FLAT, z: st0.z, yaw: st0.yaw }, 0, 0); carG.add(m);
    const ax = Math.sin(st0.yaw), az = Math.cos(st0.yaw); for (const f of [-0.27, 0.27]) { const c = { x: st0.x + ax * d.L * f, z: st0.z + az * d.L * f, r: d.Wd * 0.5, top: FLAT + d.H, parked: 1 }; api.cyl.push(c); ex.cols.push(c); } }); } catch (e) { console.warn('theater cars', e); }
  const odG = new THREE.Group(); odG.position.set(OX, FLAT, OZ); W.root.add(odG); let odBoxes = [];
  // ---------------------------------------------------------------- shared state (one doc, owner writes)
  const S0 = () => ({ col: {}, li: null, la: null, lo: null, lt: { h: 1, tint: '', sp: 0, spc: '', at: 0 }, pl: { i: 0, s: 0, p: 0, on: false, at: 0, ma: 0, mo: false } }); // pl.ma / pl.mo = movie showtime anchor / off (theater-movie.js)
  let st = S0(), owner = false, unsub = null, inside = false, party = null, ib = null, inG = null, inBoxes = [], seatCam = true, fogWas;
  const ref = doc(db, 'theater', TID);
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  function sanitize(d) {
    const o = S0(); if (!d) return o;
    if (d.col && typeof d.col === 'object') for (const [k, v] of Object.entries(d.col)) if (SURF[k] && hexOk(v)) o.col[k] = hexOk(v);
    for (const k of ['li', 'la', 'lo']) if (typeof d[k] === 'string') o[k] = d[k].slice(0, 3000);
    const lt = d.lt || {}; o.lt = { h: Math.max(0, Math.min(1, num(lt.h, 1))), tint: hexOk(lt.tint), sp: lt.sp ? 1 : 0, spc: hexOk(lt.spc), at: num(lt.at) };
    const pl = d.pl || {}; o.pl = { i: Math.max(0, num(pl.i) | 0), s: num(pl.s), p: Math.max(0, num(pl.p)), on: !!pl.on, at: num(pl.at), ma: num(pl.ma), mo: !!pl.mo };
    return o;
  }
  const items = (z) => { const s = st[z]; if (s == null) return (z === 'li' ? DEF_LI : z === 'lo' ? DEF_LO : []).map((i) => ({ ...i, parts: { ...(i.parts || {}) } })); return parseT(s, z === 'lo' ? 40 : 30); };
  const sv = (k) => st.col[k] || DEF[k];
  let saveT = 0, saving = null, lastLocal = 0;
  function save(patch) { // owner only (rules enforce it too); full doc, debounced
    if (!owner) return; lastLocal = Date.now(); Object.assign(st, patch); clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const d = { col: st.col, li: serT(items('li')), la: serT(items('la')), lo: serT(items('lo')), lt: st.lt, pl: st.pl, at: serverTimestamp(), by: uid };
      if (d.li.length > 3000 || d.la.length > 3000 || d.lo.length > 3000) { K.say('That area is full: remove something first.'); return; }
      try { saving = setDoc(ref, d); await saving; } catch (e) { console.warn('theater save', e && e.code); K.say('Could not save the theater right now.'); } finally { saving = null; }
    }, 400);
  }
  function setItems(z, L) { st[z] = serT(L); rebuildDecor(z); save({}); }
  // ---------------------------------------------------------------- canvases: sign, blade, marquee, menu
  const gold = () => sv('oMarq');
  function drawSign() { const g = ex.signCv.getContext('2d'), w = 1024, h = 160; g.clearRect(0, 0, w, h); g.fillStyle = sv('oSign'); g.fillRect(0, 0, w, h); g.strokeStyle = gold(); g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#fff6dc'; g.shadowColor = gold(); g.shadowBlur = 24; g.font = '900 104px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LONE KEEM STUDIO', w / 2, h / 2 + 4, w - 60); g.shadowBlur = 0; ex.signTex.needsUpdate = true; }
  function drawBlade() { const g = ex.bladeCv.getContext('2d'), w = 128, h = 640; g.fillStyle = sv('oSign'); g.fillRect(0, 0, w, h); g.fillStyle = '#fff6dc'; g.shadowColor = gold(); g.shadowBlur = 14; g.font = '900 64px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; 'STUDIO'.split('').forEach((c, i) => g.fillText(c, w / 2, 62 + i * 103)); g.shadowBlur = 0; ex.bladeTex.needsUpdate = true; }
  let marqKey = null;
  function drawMarq(title, sub = '') { const key = title + '|' + sub; if (key === marqKey) return; marqKey = key; const g = ex.marqCv.getContext('2d'), w = 1024, h = 160; g.fillStyle = '#fff8e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1c1c22'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#1c1c22'; g.textAlign = 'center'; g.textBaseline = 'middle'; const y1 = sub ? 38 : 48, y2 = sub ? 84 : 112; g.font = `900 ${sub ? 32 : 40}px Inter, Arial, sans-serif`; g.fillText('★ LONE KEEM STUDIO ★', w / 2, y1, w - 60); g.fillStyle = '#800020'; g.font = '900 50px Inter, Arial, sans-serif'; g.fillText(title ? 'NOW SHOWING: ' + title.toUpperCase() : 'NOW SHOWING: COMING SOON', w / 2, y2, w - 60);
    if (sub) { g.fillStyle = '#1c1c22'; g.font = '900 34px Inter, Arial, sans-serif'; g.fillText(sub, w / 2, 128, w - 60); } ex.marqTex.needsUpdate = true; }
  // ---------------------------------------------------------------- movie showings (clock-synced; see theater-movie.js)
  const show = () => showAt(Date.now(), st.pl.ma || 0, st.pl.mo, kid());
  const list = () => listings(Date.now(), st.pl.ma || 0, st.pl.mo, kid());
  const between = (sh) => sh.phase === 'title' && sh.id !== sh.ids[0]; // the credit card between films of a double feature
  const movieOn = (sh = show()) => (sh.phase === 'movie' || between(sh)) && !playing(); // a playing song overrides the movie
  function marqText() { const s = songAt(st.pl.i); if (playing() && s) return [s.title || s.key, '']; const sh = show(); if (sh.phase === 'off') return ['', ''];
    if (sh.phase === 'movie' || between(sh)) return [sh.film.short, `▶ PLAYING NOW · NEXT SHOW ${clockStr(sh.next)}`];
    if (sh.phase === 'end') return [sh.nextTitle, `NEXT SHOW ${clockStr(sh.nextSlot)}`];
    return [sh.title, `NEXT SHOW ${clockStr(sh.start)} · STARTS IN ${mmss(sh.left)}`]; }
  function movieLine() { const sh = show(); if (sh.phase === 'off') return ''; if (sh.phase === 'movie' || between(sh)) return `“${sh.film.title}” is playing right now! Grab a seat 🍿`;
    if (sh.phase === 'end') return `Next up: “${sh.nextTitle}” at ${clockStr(sh.nextSlot)}! 🍿`;
    return `Next showing: “${sh.title}” at ${clockStr(sh.start)}${sh.phase === 'count' ? `, in ${mmss(sh.left)}` : ''}! 🍿`; }
  // owner: restart the countdown, start the movie now, back to regular showtimes, or switch showtimes off/on (pl.ma / pl.mo)
  // k = program slot to start (show picker); default = the show counting down now, else the next one. Only pl.ma / pl.mo change.
  function movieCmd(cmd, k) { if (!owner) return; const pl = { ...st.pl }, now = Date.now();
    if (cmd === 'now' || cmd === 'count') { const sh = show(); const nk = k != null ? +k : sh.phase === 'off' ? 0 : sh.phase === 'count' ? sh.si : sh.si + 1; pl.ma = anchorFor(nk, now, cmd === 'count'); pl.mo = false; }
    else if (cmd === 'sched') pl.ma = 0; else if (cmd === 'off') pl.mo = true; else if (cmd === 'on') pl.mo = false; else return;
    save({ pl }); applyLights(true); scrKey = ''; paintEdit(); }
  // ---------------------------------------------------------------- songs + sync
  const songs = () => (LOCAL && Array.isArray(window.__theaterTestSongs) ? window.__theaterTestSongs : THEATER_SONGS).filter((s) => s && /^[a-z0-9-]{1,40}$/.test(s.key || ''));
  const songAt = (i) => { const L = songs(); return L.length ? L[((i % L.length) + L.length) % L.length] : null; };
  const lyr = new Map(); // key -> lines | 'loading'
  function lyricsFor(s) { if (!s) return null; const v = lyr.get(s.key); if (v && v !== 'loading') return v; if (!v) { lyr.set(s.key, 'loading'); fetch(s.lrc || new URL(`../../assets/theater/${s.key}.json`, import.meta.url).href).then((r) => r.json()).then((d) => lyr.set(s.key, Array.isArray(d) ? d : d.lines || [])).catch(() => lyr.set(s.key, [])); } return null; }
  let audio = null, audioKey = '', soundBlocked = false, durOf = {}, movie = null, movieBlocked = false, nsT = 0;
  const pos = () => (st.pl.on ? Math.max(0, (Date.now() - st.pl.s) / 1000) : st.pl.p);
  const durNow = (s) => (s ? s.dur || durOf[s.key] || Infinity : Infinity);
  const playing = () => { const s = songAt(st.pl.i); return !!(st.pl.on && s && pos() < durNow(s) + 0.5); };
  function ensureAudio() { if (!audio) { audio = new Audio(); audio.preload = 'auto'; audio.addEventListener('loadedmetadata', () => { if (audioKey && Number.isFinite(audio.duration)) durOf[audioKey] = audio.duration; }); } return audio; }
  function syncAudio() {
    const s = songAt(st.pl.i), want = inside && s && playing();
    if (!want) { if (audio && !audio.paused) audio.pause(); return; }
    const a = ensureAudio(); if (audioKey !== s.key) { audioKey = s.key; a.src = s.src || new URL(`../../assets/theater/${s.key}.mp3`, import.meta.url).href; }
    const p = pos(); if (a.readyState >= 1 && Math.abs(a.currentTime - p) > 0.6) { try { a.currentTime = p; } catch { /* */ } }
    a.volume = P.z - RZ > 4.2 ? 0.35 : 1;
    if (a.paused) a.play().then(() => { if (soundBlocked) { soundBlocked = false; paintHud(); } }).catch(() => { if (!soundBlocked) { soundBlocked = true; paintHud(); } });
  }
  // owner transport (Play / Pause / Next); every client follows st.pl
  function transport(cmd, i) {
    if (!owner) return; const L = songs(); const now = Date.now(); const pl = { ...st.pl };
    if (cmd === 'play') { if (!L.length) { K.say('No songs yet: the screen shows Coming Soon.'); return; } if (i != null) { pl.i = i; pl.p = 0; } else if (pos() >= durNow(songAt(pl.i))) pl.p = 0; pl.s = now - (i != null ? 0 : pl.p) * 1000; pl.on = true; }
    else if (cmd === 'pause') { pl.p = pos(); pl.on = false; }
    else if (cmd === 'next') { if (!L.length) return; pl.i = (pl.i + 1) % L.length; pl.p = 0; pl.s = now; pl.on = true; }
    else if (cmd === 'stop') { pl.on = false; pl.p = 0; }
    pl.at = now; save({ pl }); applyLights(true); paintEdit();
  }
  // ---------------------------------------------------------------- lights (house level fades ~2.5 s; aisle, steps, exits stay lit)
  let lvl = 1, lvlT = 1; const cTmp = new THREE.Color(), cT2 = new THREE.Color();
  const DIM = ['aCarpet', 'aWall', 'aPanel', 'aStage', 'aFrame', 'aCeil', 'aTruss', 'aRail', 'aSeatF', 'aSeatC', 'aCurt'];
  // owner's last manual setting wins until the next automatic change (a song Play/Pause, or a movie starting or ending)
  function autoAt() { const sh = show(), now = Date.now(); let a = st.pl.at; if (sh.phase === 'movie') a = Math.max(a, sh.start); else if (between(sh)) a = Math.max(a, sh.start - TC * 1000); else if (sh.phase === 'end') a = Math.max(a, sh.slotEnd); else if (sh.phase === 'count' || sh.phase === 'title') a = Math.max(a, Math.min(now, sh.at)); return a; }
  const manualLights = () => st.lt.at > autoAt();
  function targetLevel() { if (manualLights()) return st.lt.h; return playing() || movieOn() ? 0.12 : 1; }
  function applyLights(force) {
    if (!ib) return; lvlT = targetLevel(); if (force === 'snap') lvl = lvlT; const tint = st.lt.tint ? cT2.set(st.lt.tint) : cT2.setRGB(1, 1, 1);
    for (const k of DIM) for (const m of ib.mats[k] || []) { cTmp.set(sv(k)).multiply(tint).multiplyScalar(0.06 + 0.94 * lvl); m.color.copy(cTmp); }
    for (const m of ib.mats.aStep || []) m.color.set(sv('aStep')).multiplyScalar(0.55 + 0.45 * lvl);
    for (const m of ib.mats.aAisle || []) m.color.set(sv('aAisle'));
    for (const m of ib.mats.aScreen || []) m.color.set(sv('aScreen'));
    for (const m of ib.mats.aLight || []) m.color.set(sv('aLight'));
    cTmp.set(sv('aLight')).multiply(tint); ib.tipM.color.copy(cTmp).multiplyScalar(0.25 + 0.75 * lvl); ib.scM.color.copy(cTmp).multiplyScalar(0.2 + 0.8 * lvl);
    for (const k of ['lFloor', 'lWall', 'lCeil', 'lCounter', 'lTop', 'lTrim', 'lPoster']) for (const m of ib.mats[k] || []) m.color.set(sv(k));
    ib.lobM.color.set(sv('lLight'));
    const spc = st.lt.spc || sv('aSpot'); ib.spotM.color.set(spc); ib.discM.color.set(spc); ib.spotCone.visible = ib.spotDisc.visible = !!st.lt.sp;
    if (laMat) laMat.color.setScalar(0.06 + 0.94 * lvl);
  }
  function applyOutside() { for (const [k, ms] of Object.entries(ex.mats)) for (const m of ms) m.color.set(sv(k)); drawSign(); drawBlade(); }
  // ---------------------------------------------------------------- decor (lobby li / auditorium la / outside lo)
  let liG = null, laG = null, laMat = null; const decSeats = { li: [], la: [], lo: [] };
  const yIn = (x, z) => { if (!ib) return 0; let y = 0; for (const b of ib.boxes) if (b.top < 50 && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) y = Math.max(y, b.top); return y; };
  function rebuildDecor(z) {
    const L = items(z), out = z === 'lo'; let grp, y0;
    if (out) { grp = odG; for (const b of odBoxes) { const i = api.box.indexOf(b); if (i >= 0) api.box.splice(i, 1); } odBoxes = []; }
    else { if (!ib) return; if (z === 'li') { liG && liG.removeFromParent(); liG = grp = new THREE.Group(); } else { laG && laG.removeFromParent(); laG = grp = new THREE.Group(); } inG.add(grp); }
    for (const c of [...grp.children]) { c.removeFromParent(); c.geometry && c.geometry.dispose(); }
    const seats = [];
    for (const it of L) {
      if (out && ['xl', 'xp'].includes(it.c) && !poleClear(OX + it.x, OZ + it.z, it.c === 'xl' ? 0.3 : 0.6)) continue; // never a lamp / planter (or its collider) on the road
      y0 = out ? 0 : z === 'li' ? IN.LY : yIn(it.x, it.z);
      for (const s of kit.piece('d', 'dg', it, y0, !out)) seats.push({ x: s.x + (out ? OX : RX), z: s.z + (out ? OZ : RZ), y: s.y + FLAT, yaw: s.yaw, fl: y0 + FLAT, zone: z });
      if (out && ['xl', 'xp'].includes(it.c)) { const ft = it.c === 'xl' ? 0.25 : 0.55; const b = { x0: OX + it.x - ft, x1: OX + it.x + ft, z0: OZ + it.z - ft, z1: OZ + it.z + ft, top: FLAT + (it.c === 'xl' ? 99 : 1.2), bot: FLAT - 1, theaterDecor: 1 }; odBoxes.push(b); api.box.push(b); }
    }
    const m = out ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }) : new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    if (z === 'la') laMat = m;
    kit.flush('d', m, grp, out && !LOW); kit.flush('dg', new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), grp, false);
    decSeats[z] = seats; if (z === 'la') applyLights();
  }
  // ---------------------------------------------------------------- inside (built on first visit)
  function buildIn() {
    if (ib) return; inG = new THREE.Group(); inG.name = 'theater-in'; inG.position.set(RX, FLAT, RZ); inG.visible = false; W.root.add(inG);
    ib = buildInterior(THREE, kit, inG, LOW);
    const extra = [[-IN.X - 1, IN.X + 1, IN.Z1 + 0.05, IN.Z1 + 1, 99], [-IN.X, -3, 4.0, 4.3, 99], [3, IN.X, 4.0, 4.3, 99], [14.6, 17.6, -17, -16.4, 0.5], [-17.6, -14.6, -17, -16.4, 0.5]];
    for (const [x0, x1, z0, z1, top] of extra) ib.boxes.push({ x0, x1, z0, z1, top, bot: -2 });
    inBoxes = ib.boxes.map((b) => ({ x0: b.x0 + RX, x1: b.x1 + RX, z0: b.z0 + RZ, z1: b.z1 + RZ, top: b.top >= 50 ? 99 : b.top + FLAT, bot: b.bot + FLAT, theaterIn: 1 }));
    ib.wSeats = ib.seats.map((s, i) => ({ x: s.x + RX, z: s.z + RZ, y: s.y + FLAT + 0.52, yaw: s.yaw, fl: s.fl + FLAT, aud: true, i }));
    drawMenu(); rebuildDecor('li'); rebuildDecor('la'); applyLights('snap'); npc && npc.inReady(ib, inG);
  }
  function drawMenu() { const g = ib.menuCv.getContext('2d'), w = 512, h = 200; g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4af37'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#d4af37'; g.font = '900 26px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍿 SNACK BAR · ⭐ Star Coins', w / 2, 26);
    SN_LIST.forEach((s, i) => { const x = i < 4 ? 30 : 270, y = 64 + (i % 4) * 34; g.textAlign = 'left'; g.fillStyle = '#fff6dc'; g.font = '700 20px Inter, Arial, sans-serif'; g.fillText(`${s.e} ${s.name}`, x, y, 170); g.textAlign = 'right'; g.fillStyle = '#ffd36b'; g.fillText('⭐' + s.p, x + 216, y); });
    ib.menuTex.needsUpdate = true; }
  let SN_LIST = []; import('./theater-snacks.js').then((m) => { SN_LIST = m.THEATER_SNACKS; if (ib) drawMenu(); });
  // ---------------------------------------------------------------- screen
  const OH = Math.round(512 * IN.SCR.h / IN.SCR.w); // lyric card at the screen's own ~2.4:1 so it fills edge to edge (no black bars)
  let scrT = 0, idleT = -1, scrKey = ''; const off = document.createElement('canvas'); off.width = 512; off.height = OH; const og = off.getContext('2d');
  function drawScreen(now) {
    const cv = ib.scrCv, g = cv.getContext('2d'), w = cv.width, h = cv.height, s = songAt(st.pl.i), on = playing();
    if (!on) { const sh = show(); if (sh.phase !== 'off') { // the movie is the default showing: countdown, film, thanks card
      const key = sh.phase === 'movie' ? 'm' + sh.key : sh.phase + sh.si + sh.id; if (key === scrKey && (sh.phase === 'movie' || now - idleT < 0.5)) return; scrKey = key; idleT = now;
      drawMovieScreen(g, w, h, sh, now); ib.scrTex.needsUpdate = true; return; } }
    scrKey = '';
    if (!on && !(st.pl.p > 0 && s)) { // idle: Coming Soon (redrawn ~2x a second)
      if (now - idleT < 0.5) return; idleT = now;
      // classy bright idle screen (the reference look: big white screen), burgundy + gold type
      const gr = g.createRadialGradient(w / 2, h * 0.45, h * 0.1, w / 2, h / 2, w * 0.62); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f3f0ea'); gr.addColorStop(1, '#d9d4cb'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.35; for (let i = 0; i < 26; i++) { const x = (i * 97.3 + now * 6 * (1 + (i % 3))) % w, y = (i * 53.7) % h; g.fillStyle = '#d4af37'; g.fillRect(x, y, 3, 3); } g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#800020'; g.font = `900 ${Math.round(h * 0.17)}px Inter, Arial, sans-serif`; g.fillText('LONE KEEM STUDIO', w / 2, h * 0.36, w * 0.9);
      g.fillStyle = '#b8962e'; g.fillRect(w * 0.3, h * 0.49, w * 0.4, Math.max(2, h * 0.008));
      g.fillStyle = '#8a6d14'; g.font = `700 ${Math.round(h * 0.075)}px Inter, Arial, sans-serif`; g.fillText('Now Showing', w / 2, h * 0.585);
      g.fillStyle = '#800020'; g.font = `900 ${Math.round(h * 0.12)}px Inter, Arial, sans-serif`; g.globalAlpha = 0.8 + 0.2 * Math.sin(now * 2); g.fillText('Coming Soon', w / 2, h * 0.74); g.globalAlpha = 1;
      ib.scrTex.needsUpdate = true; return;
    }
    idleT = -1; if (now - scrT < (LOW ? 1 / 20 : 1 / 30)) return; scrT = now;
    const t = audio && !audio.paused && audioKey === s.key ? audio.currentTime : pos(); const L = lyricsFor(s);
    og.setTransform(1, 0, 0, 1, 0, 0); const gr = og.createLinearGradient(0, 0, 512, OH); const hue = (now * 8) % 360; gr.addColorStop(0, `hsl(${hue},55%,9%)`); gr.addColorStop(1, `hsl(${(hue + 60) % 360},55%,6%)`); og.fillStyle = gr; og.fillRect(0, 0, 512, OH);
    drawLyrics(og, 512, OH, L || [], t, { main: '#d4af37', alt: '#ff5a7a' }, s.title || s.key, s.artist || 'Lone Keem');
    if (!on) { og.fillStyle = 'rgba(0,0,0,.45)'; og.fillRect(0, 0, 512, OH); og.fillStyle = '#fff'; og.font = '900 30px Inter, Arial, sans-serif'; og.textAlign = 'center'; og.fillText('⏸ Paused', 256, 200); }
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const sc = Math.min(w / 512, h / OH); g.drawImage(off, (w - 512 * sc) / 2, (h - OH * sc) / 2, 512 * sc, OH * sc); ib.scrTex.needsUpdate = true;
  }
  // ---------------------------------------------------------------- enter / leave
  // only the movie (or an owner-started theater song) is heard inside: everything else pauses locally, resumes on the way out
  const hush = createTheaterHush({ ours: () => [audio, ...(movie ? movie.videos : [])], say: (m) => K.say(m) });
  const driving = () => { try { const m = W.drive && W.drive.mine && W.drive.mine(); return !!(m && m.state && m.state !== 'parked'); } catch { return false; } };
  function enter() {
    { const rt = document.getElementById('p3-rotip'); if (rt) rt.hidden = true; }
    if (inside) return; if (driving()) { K.say('🚗 Park your car first, then walk in!'); return; }
    if (roomState.inId) { K.say('Leave this place first.'); return; }
    buildIn(); inside = true; inG.visible = true; if (!movie) movie = createMoviePlayer(THREE, ib, { IN, LOW, onBlocked: (b) => { if (b !== movieBlocked) { movieBlocked = b; paintHud(); } } }); scrKey = ''; nsT = 0; for (const b of inBoxes) api.box.push(b);
    if (P.sit && P.sit.off) { try { P.sit.off(); } catch { P.sit = null; } }
    P.x = RX; P.z = RZ + 17; P.y = FLAT + IN.LY; P.yaw = Math.PI; P.vy = 0; P.onGround = true; try { window.__p3 && window.__p3.setYaw && window.__p3.setYaw(0); } catch { /* */ }
    roomState.box = { x0: RX - IN.X + 0.4, x1: RX + IN.X - 0.4, z0: RZ + IN.Z0 + 0.4, z1: RZ + IN.Z1 - 0.4 }; roomState.inId = T.plot; roomState.outSpot = { x: T.door[0] + 1.6, z: T.door[1], yaw: Math.PI / 2 }; roomState.leave = (q) => leave(q);
    roomState.camOv = camOv; { const f = api.scene && api.scene.fog; fogWas = f ? { f, near: f.near, far: f.far, density: f.density } : null; if (f) { if (f.density != null) f.density = 0; else { f.near = 1e4; f.far = 2e4; } } } // world fog off inside (keep the object: day/night tints it)
    if (uid) try { party = startHouseParty({ db, uid, plot: T.plot, cx: RX, cz: RZ, P, S, others: api.others, say: K.say, quietPark: api.quietPark, dropPal: api.dropPal, onFull: () => K.say('🎬 The theater is packed! Some guests are hidden.'), k: 50, cap: 40 }); } catch (e) { console.warn('theater party', e); }
    hush.enter(); ensureAudio(); soundBlocked = false; syncAudio(); paintHud(); api.markDirty && api.markDirty(); api.send && api.send(true);
    K.say('🎬 Welcome to Lone Keem Studio! Free entry, grab a seat 🍿');
  }
  function leave(quiet) {
    if (!inside) return; inside = false; standUp(true); if (party) { try { party.stop(); } catch { /* */ } party = null; }
    for (const b of inBoxes) { const i = api.box.indexOf(b); if (i >= 0) api.box.splice(i, 1); } if (inG) inG.visible = false;
    if (roomState.inId === T.plot) { roomState.box = null; roomState.inId = null; roomState.outSpot = null; roomState.leave = null; }
    if (roomState.camOv === camOv) roomState.camOv = null; if (fogWas) { const f = fogWas.f; if (fogWas.density != null) f.density = fogWas.density; else { f.near = fogWas.near; f.far = fogWas.far; } fogWas = null; }
    if (audio) audio.pause(); if (movie) movie.unload(); movieBlocked = false; closePanels(); hush.leave(); // resume only what was playing before you walked in
    if (!quiet) { P.x = T.door[0] + 1.6; P.z = T.door[1]; P.y = FLAT; P.yaw = Math.PI / 2; P.vy = 0; P.onGround = true; try { window.__p3 && window.__p3.setYaw && window.__p3.setYaw(-Math.PI / 2); } catch { /* */ } }
    paintHud(); api.markDirty && api.markDirty(); api.send && api.send(true);
  }
  // ---------------------------------------------------------------- sitting (auditorium seats + every sittable decor piece)
  const allSeats = () => (inside ? [...(ib ? ib.wSeats : []), ...decSeats.li, ...decSeats.la] : decSeats.lo);
  const seatTaken = (s) => { if (npc && npc.seatTaken(s)) return true; if (api.others) for (const o of api.others.values()) if (o.dn === 'sit' && Math.hypot(o.x - s.x, o.z - s.z) < 0.4) return true; return false; };
  let seatNear = null, seatChk = 0;
  function findSeat() { let b = null, bd = 1.15; for (const s of allSeats()) { const d = Math.hypot(P.x - s.x, P.z - s.z); if (d < bd && Math.abs(P.y - s.fl) < 1.0 && !seatTaken(s)) { bd = d; b = s; } } return b; }
  function sitAt(s) {
    if (!s || driving()) return; const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    P.sit = { x: s.x, z: s.z, y: s.y - 0.36, yaw: s.yaw, seat: s, back: [s.x + fx * 0.6, s.z + fz * 0.6, s.fl], ext: true, th: 1, off: () => standUp() };
    P.x = s.x; P.z = s.z; P.y = P.sit.y; P.yaw = s.yaw; P.vy = 0; P.dance = 'sit'; P.danceUntil = Date.now() + 864e5; api.markDirty && api.markDirty(); api.send && api.send(true); paintHud();
  }
  function standUp(silent) {
    if (!P.sit || !P.sit.th) return; const b = P.sit.back; P.sit = null; if (P.dance === 'sit') { P.dance = ''; P.danceUntil = 0; }
    if (b) { P.x = b[0]; P.z = b[1]; P.y = b[2]; } P.vy = 0; P.onGround = true; if (!silent) { api.markDirty && api.markDirty(); api.send && api.send(true); } paintHud();
  }
  const cv1 = new THREE.Vector3(), cl1 = new THREE.Vector3(), look = new THREE.Vector3(); let camInit = false;
  function camOv(cam, dt) {
    if (!inside || !seatCam || !P.sit || !P.sit.th || !P.sit.seat || !P.sit.seat.aud) { camInit = false; return false; }
    const s = P.sit.seat, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); cv1.set(s.x - fx * 1.7, s.y + 1.55, s.z - fz * 1.7); cl1.set(RX, FLAT + IN.SCR.y + IN.SCR.h * 0.5, RZ + IN.SCR.z);
    const k = camInit ? 1 - Math.exp(-dt * 5) : 1; camInit = true; cam.position.lerp(cv1, k); look.lerp(cl1, k); if (k === 1) look.copy(cl1); cam.lookAt(look); return true;
  }
  // ---------------------------------------------------------------- snacks (Star Coins only, the normal Pal Shop path)
  let econ = null, held = null, heldSpr = null;
  async function econReady() { if (!uid) throw new Error('Sign in to buy snacks.'); if (!econ) { const [{ createEconomy }, sn] = await Promise.all([import('../pals/economy.js'), import('./theater-snacks.js')]); await sn.registerTheaterSnacks(); econ = createEconomy(db, uid); } return econ; }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let panel = null; function closePanels() { document.body.classList.remove('th-pnl'); if (panel) { panel.remove(); panel = null; } if (editP) { editP.remove(); editP = null; } }
  async function snackMenu(who) {
    closePanels(); const d = document.createElement('div'); d.className = 'ks-panel th-p'; panel = d; K.hud.appendChild(d); document.body.classList.add('th-pnl');
    d.innerHTML = `<div class="ks-card th-card"><h3>🍿 Snack Bar</h3><p class="th-sub">${who ? esc(who) + ': ' : ''}Everything is paid with ⭐ Star Coins you earn in Kemy. No real money, ever.</p><div class="th-w">⭐ …</div><div class="th-grid"></div><h4>🎒 My snacks</h4><div class="th-mine">…</div><button type="button" class="ghost th-x" style="width:100%">Close</button></div>`;
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.th-x')) closePanels(); });
    let E; try { E = await econReady(); } catch (e) { d.querySelector('.th-w').textContent = e.message || 'Sign in to buy snacks.'; return; }
    const { THEATER_SNACKS } = await import('./theater-snacks.js');
    const paint = async () => { if (panel !== d) return; let w = {}, inv = {}; try { [w, inv] = await Promise.all([E.wallet(true), E.inventory(true)]); } catch { /* */ }
      d.querySelector('.th-w').textContent = `⭐ ${w.coins === Infinity ? '∞' : (w.coins | 0)} Star Coins`;
      d.querySelector('.th-grid').innerHTML = THEATER_SNACKS.map((s) => `<button type="button" class="th-sn" data-buy="${s.id}"><b>${s.e}</b>${esc(s.name)}<i>⭐ ${s.p}</i></button>`).join('');
      const mine = THEATER_SNACKS.filter((s) => (inv[s.id] | 0) > 0);
      d.querySelector('.th-mine').innerHTML = mine.length ? mine.map((s) => `<div class="th-row"><span>${s.e} ${esc(s.name)} ×${inv[s.id] | 0}</span><button type="button" data-hold="${s.id}">✋ Hold</button><button type="button" data-eat="${s.id}">😋 Eat</button></div>`).join('') : '<p class="th-sub">Nothing yet. Pick a snack above!</p>'; };
    d.addEventListener('click', async (e) => { const b = e.target.closest('button'); if (!b || b.disabled) return; const sn = THEATER_SNACKS.find((s) => s.id === (b.dataset.buy || b.dataset.hold || b.dataset.eat)); if (!sn) return; b.disabled = true;
      try { if (b.dataset.buy) { await E.buy(sn.id); K.say(`${sn.e} You got ${sn.name}! Enjoy the show.`); hold(sn); } else if (b.dataset.hold) hold(sn); else if (await E.use(sn.id)) { eat(sn); } } catch (er) { K.say((er && er.message) || 'That did not work. Try again.'); }
      b.disabled = false; paint(); });
    paint();
  }
  function hold(sn) { held = sn; emote(sn.e); if (!heldSpr) { heldSpr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); heldSpr.scale.set(0.55, 0.55, 1); W.root.add(heldSpr); }
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.font = '76px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sn.e, 48, 54); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; if (heldSpr.material.map) heldSpr.material.map.dispose(); heldSpr.material.map = tx; heldSpr.material.needsUpdate = true; heldSpr.visible = true; paintHud(); }
  function eat(sn) { held = null; if (heldSpr) heldSpr.visible = false; emote('😋'); K.say(`😋 Yum! ${sn.name} was delicious.`); paintHud(); }
  function emote(e) { P.e = e; P.eAt = Date.now(); P.tgt = ''; if (EMO[e] && !P.sit) { P.dance = EMO[e]; P.danceUntil = Date.now() + 5000; } api.markDirty && api.markDirty(); api.send && api.send(true); }
  // ---------------------------------------------------------------- HUD (inside): snacks, view, sound, edit, exit
  if (!document.getElementById('th-css')) { const c = document.createElement('style'); c.id = 'th-css'; c.textContent = `
.th-hud{position:absolute;right:max(10px,env(safe-area-inset-right));top:calc(max(8px,env(safe-area-inset-top)) + 172px);display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:auto;z-index:7}
.th-hud[hidden]{display:none}.th-crl{position:absolute;left:max(10px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + 312px);z-index:6;pointer-events:auto;display:flex;align-items:center;gap:6px;max-width:min(72vw,340px);height:30px;box-sizing:border-box;border:1px solid rgba(212,175,55,.6);border-radius:15px;background:rgba(0,0,0,.62);color:#fff;font:700 12px/1 Inter,system-ui,sans-serif;padding:0 10px 0 8px;white-space:nowrap;text-shadow:0 1px 2px #000;transition:opacity .6s ease}.th-crl[hidden]{display:none}.th-crl.fo{opacity:0}.th-crl b{flex:none;font-weight:800}.th-crl .mk{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:600;opacity:.9}.th-crl i{flex:none;font-style:normal;font-weight:800;color:#ffd36b}.th-crl.mini{width:34px;height:34px;max-width:none;padding:0;border-radius:50%;justify-content:center;font-size:17px;background:rgba(0,0,0,.55)}@media (orientation:landscape){.th-crl{top:calc(max(8px,env(safe-area-inset-top)) + 164px);max-width:min(45vw,380px)}}body.th-pnl .kh-stuck,body.th-pnl #p3-rot,body.th-pnl #p3-set,body.th-pnl #game-music,body.th-pnl .th-crl,body.th-cardup .p3-tag.me>span{visibility:hidden}
.th-cf{padding:8px 10px;margin:6px 0;border-radius:12px;background:rgba(255,255,255,.07);font-size:14px;line-height:1.4}.th-cf b{color:#fff6dc;font-size:16px}.th-cf p{margin:3px 0}.th-cf .th-k{color:#ffd36b;font-weight:800}.th-url{user-select:text;-webkit-user-select:text;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#fff;word-break:break-all;background:rgba(0,0,0,.3);padding:0 4px;border-radius:4px}.th-cbtn{width:100%;margin-top:6px}
.th-hud button{min-height:40px;border-radius:999px;border:1px solid rgba(212,175,55,.7);background:rgba(60,4,18,.82);color:#fff6dc;font:800 13px Inter,system-ui,sans-serif;padding:0 12px}
.th-card{background:#3a0712!important;border:2px solid #d4af37}.th-card h3{color:#ffd36b}.th-card h4{margin:12px 0 6px;color:#ffd36b}.th-sub{margin:0 0 8px;opacity:.85;font-size:13px}.th-w{font-weight:900;margin:4px 0 8px}
.th-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.th-card .th-sn{display:flex;flex-direction:column;align-items:center;gap:2px;margin:0;padding:6px 2px;min-height:76px;background:rgba(255,255,255,.1);color:#fff;font:700 11px Inter,sans-serif}.th-sn b{font-size:26px}.th-sn i{font-style:normal;color:#ffd36b}
.th-times{max-height:min(86vh,680px);overflow:auto}.th-tr{display:flex;align-items:center;gap:10px;padding:6px;margin:4px 0;border-radius:12px;background:rgba(255,255,255,.06)}.th-tr.now{background:rgba(212,175,55,.28)}.th-tr.next{background:rgba(212,175,55,.14)}
.th-tr img{width:54px;height:87px;object-fit:cover;border:2px solid #d4af37;border-radius:4px;flex:none;background:#3b1d0e}.th-ti{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.th-ti b{color:#fff6dc;font-size:15px}.th-ti small{opacity:.8;font-size:12px}.th-ti .th-cr{opacity:.6;font-size:11px}
.th-tt{text-align:right;font-weight:800;font-size:13px;color:#fff;flex:none}.th-tt em{display:block;font-style:normal;font-size:11px;font-weight:900;margin-bottom:2px}.th-now{color:#ff8a8a}.th-next{color:#ffd36b}.th-lic{font-size:11px;margin-top:8px}
.th-row{display:flex;align-items:center;gap:6px;margin:4px 0}.th-row span{flex:1;font-weight:700}.th-card .th-row button{margin:0;min-height:40px;padding:0 10px;font-size:13px}
.th-bub{position:absolute;left:50%;bottom:calc(max(18px,env(safe-area-inset-bottom)) + 130px);transform:translateX(-50%);background:#fff;color:#3a0712;border-radius:18px;padding:10px;pointer-events:auto;z-index:9;box-shadow:0 6px 18px rgba(0,0,0,.35);max-width:min(92vw,360px);font:700 14px Inter,sans-serif;text-align:center}
.th-bub .th-bn{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}.th-bub button{min-height:42px;border-radius:999px;border:0;background:#800020;color:#fff6dc;font:800 13px Inter,sans-serif;padding:0 12px}.th-bub button.ghost{background:#eee;color:#3a0712}
@media (max-height:500px){.th-hud{top:calc(max(6px,env(safe-area-inset-top)) + 62px);gap:5px}.th-hud button{min-height:32px;font-size:12px;padding:0 10px}.th-bub{bottom:calc(max(8px,env(safe-area-inset-bottom)) + 58px);max-height:calc(100vh - 140px);overflow:auto}}`; document.head.appendChild(c); }
  const hudEl = document.createElement('div'); hudEl.className = 'th-hud'; hudEl.hidden = true; K.hud.appendChild(hudEl);
  // the current film's credit + license, always on screen while a film (or its title card) is up; tap = credits panel
  const crEl = document.createElement('button'); crEl.type = 'button'; crEl.className = 'th-crl'; crEl.hidden = true; crEl.dataset.thCredit = ''; crEl.title = crEl.ariaLabel = 'Film credits & licenses'; K.hud.appendChild(crEl);
  let crKey = '', crMode = '', crUntil = 0; const CR_FULL = 8000; // full line for 8 s when a film starts (or you walk in mid-film), then a small 🎬 button
  crEl.addEventListener('click', () => creditsPanel());
  function paintCredit() { const sh = inside && !playing() ? show() : null, f = sh && (sh.phase === 'movie' || sh.phase === 'title') && sh.film && sh.film.credit ? sh.film : null, now = performance.now();
    const card = f && sh.phase === 'title' && sh.left <= CARD && f.makers; // the big screen card already says it all
    document.body.classList.toggle('th-cardup', !!card); const k = f && sh.phase === 'movie' ? f.id + ':' + sh.start : ''; if (k && k !== crKey) crUntil = now + CR_FULL; if (f ? sh.phase === 'movie' : true) crKey = k;
    const mode = !f || card ? 'off' : now < crUntil ? 'full' : now < crUntil + 650 ? 'fade' : 'mini', id = f ? f.id : '';
    if (mode + id === crMode) return; const was = crMode; crMode = mode + id; crEl.hidden = mode === 'off'; if (mode === 'off') return;
    crEl.classList.toggle('fo', mode === 'fade'); crEl.classList.toggle('mini', mode === 'mini'); crEl.dataset.mode = mode;
    if (mode === 'mini') crEl.textContent = '🎬';
    else if (!was.startsWith('fade') || !was.endsWith(id)) crEl.innerHTML = `🎬 <b>${esc(f.title)}</b><span class="mk">by ${esc(f.makers || f.credit)}</span><i>${esc(f.lic)}</i>`; }
  function paintHud() {
    hudEl.hidden = !inside; if (!inside) return; const aud = P.sit && P.sit.th && P.sit.seat && P.sit.seat.aud;
    hudEl.innerHTML = `<button type="button" data-h="times">🕒 Showtimes</button><button type="button" data-h="snack">🍿 Snacks</button>${held ? `<button type="button" data-h="eat">😋 Eat ${held.e}</button>` : ''}${aud ? `<button type="button" data-h="view">🎥 ${seatCam ? 'Free look' : 'Screen view'}</button>` : ''}${soundBlocked || movieBlocked ? '<button type="button" data-h="sound">🔊 Tap for sound</button>' : ''}${owner ? '<button type="button" data-h="edit">🎨 Edit theater</button>' : ''}<button type="button" data-h="exit">🚪 Exit</button>`;
  }
  hudEl.addEventListener('click', async (e) => { const b = e.target.closest('button'); if (!b) return; const h = b.dataset.h;
    if (h === 'snack') snackMenu(); else if (h === 'times') timesPanel(); else if (h === 'exit') leave(); else if (h === 'view') { seatCam = !seatCam; paintHud(); }
    else if (h === 'sound') { soundBlocked = false; if (audio && playing()) audio.play().catch(() => { soundBlocked = true; }); if (movie) movie.unlockSound(); movieBlocked = movie ? movie.blocked : false; syncAudio(); paintHud(); }
    else if (h === 'eat' && held) { const sn = held; try { const E = await econReady(); if (await E.use(sn.id)) eat(sn); else { held = null; if (heldSpr) heldSpr.visible = false; paintHud(); } } catch (er) { K.say((er && er.message) || 'Try again.'); } }
    else if (h === 'edit') openEdit(); });
  // ---------------------------------------------------------------- showtimes: 2D list (HUD button, the lobby board, a prompt by it)
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'; } catch { return 'local time'; } })();
  function timesPanel() {
    closePanels(); const d = document.createElement('div'); d.className = 'ks-panel th-p'; d.dataset.thTimes = ''; panel = d; K.hud.appendChild(d); document.body.classList.add('th-pnl'); let key = '';
    const paint = () => { if (panel !== d) { clearInterval(iv); return; } const now = Date.now(), L = list(); const k = clockStr(now) + JSON.stringify(L.map((e) => [e.id, e.now, e.next, e.times])); if (k === key) return; key = k;
      d.innerHTML = `<div class="ks-card th-card th-times"><h3>🕒 Showtimes · Auditorium 1</h3><p class="th-sub">Free entry. Times are in your time zone (${esc(tz)}), now ${esc(clockStr(now))}. Every show starts with a 5:00 countdown.</p>${L.length ? L.map((e) => `<div class="th-tr${e.now ? ' now' : e.next ? ' next' : ''}" data-film="${e.id}"><img src="${esc(e.film.poster)}" alt="" loading="lazy" decoding="async" width="54" height="87"><div class="th-ti"><b>${esc(e.film.title)}</b><small>${esc(runtime(e.film))} · ${esc(e.film.rating)}</small><small class="th-cr">${e.film.credit ? esc(e.film.credit) : 'A Lone Keem original'}</small></div><div class="th-tt">${e.now ? '<em class="th-now">● NOW PLAYING</em>' : e.next ? '<em class="th-next">UP NEXT</em>' : ''}<span>${e.times.map((t) => esc(clockStr(t))).join('<br>')}</span></div></div>`).join('') : '<p>Showtimes are paused right now. Check back soon!</p>'}<p class="th-sub th-lic">${esc(boardFooter(L))}. Shown unchanged (re-encoded for the app).</p><button type="button" class="th-cbtn" data-credits>📜 Film credits &amp; licenses</button><button type="button" class="ghost th-x" style="width:100%">Close</button></div>`; };
    const iv = setInterval(paint, 1000); paint(); d.addEventListener('click', (e) => { if (e.target.closest('[data-credits]')) creditsPanel(); else if (e.target === d || e.target.closest('.th-x')) closePanels(); });
  }
  // 📜 Film credits & licenses: every film, its makers, license (deed address) and source page. Addresses are plain
  // selectable text, never links (no <a href>, no window.open): Kemy is kid-directed.
  function creditsPanel() {
    closePanels(); const d = document.createElement('div'); d.className = 'ks-panel th-p'; d.dataset.thCredits = ''; panel = d; K.hud.appendChild(d); document.body.classList.add('th-pnl');
    const u = (x) => `<span class="th-url">${esc(bareUrl(x))}</span>`;
    const row = (f) => { const sa = /-SA/.test(f.lic), parts = f.reels.length > 1 ? `split into ${f.reels.length} parts played back to back, and ` : '';
      return `<div class="th-cf" data-cf="${f.id}"><b>${esc(f.title)}</b>${f.sub ? ` <span>— ${esc(f.sub)}</span>` : ''} <span>(${esc(String(f.year))})</span>
<p>${esc(f.credit)}</p><p><span class="th-k">Made by:</span> ${esc(f.makers)}</p>
<p><span class="th-k">License:</span> ${esc(f.lic)} (${esc(licName(f.lic))}) · ${u(licDeed(f.lic))}</p>
<p><span class="th-k">Source:</span> ${u(f.page || f.src)}</p>
<p class="th-sub">${sa ? `Kemy shows this film unmodified, except that it is ${parts}re-encoded to 720p for the app. It stays under ${esc(f.lic)}.` : `Shown unchanged, except ${parts}re-encoded to 720p for the app.`}</p></div>`; };
    d.innerHTML = `<div class="ks-card th-card th-times"><h3>📜 Film credits &amp; licenses</h3><p class="th-sub">Lone Keem Studio plays these open films under Creative Commons licenses. Web addresses are plain text: type one into a browser to read the license or visit the source.</p>${creditFilms().map(row).join('')}<button type="button" class="ghost" data-back style="width:100%">🕒 Back to showtimes</button><button type="button" class="ghost th-x" style="width:100%">Close</button></div>`;
    d.addEventListener('click', (e) => { if (e.target.closest('[data-back]')) timesPanel(); else if (e.target === d || e.target.closest('.th-x')) closePanels(); });
  }
  // lobby posters: title plate + next time (redrawn only when the text changes)
  function drawPlates(L, arr = ib && ib.lobbyPosters) { if (!arr) return; const by = new Map(L.map((e) => [e.id, e])), k = kid();
    for (const p of arr) { const id = p.id === 'sheriff' && k ? program(true)[SHERIFF_SLOT].ids[0] : p.id, e = by.get(id), title = p.id === 'sheriff' && k ? slotTitle(program(true)[SHERIFF_SLOT].ids) : FILMS[id].short;
      const sub = !e ? 'Coming soon' : e.now ? '▶ Now playing' : `Next show ${clockStr(e.times[0])}`, key = title + '|' + sub; if (key === p.key) continue; p.key = key;
      const g = p.cv.getContext('2d'), w = p.cv.width, h = p.cv.height; g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4af37'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd36b'; g.font = '900 40px Inter, Arial, sans-serif'; g.fillText(title.toUpperCase(), w / 2, 40, w - 30);
      g.fillStyle = e && e.now ? '#ff8a8a' : '#fff6dc'; g.font = '800 30px Inter, Arial, sans-serif'; g.fillText(sub, w / 2, 88, w - 30); p.tex.needsUpdate = true; } }
  // tap the board in the lobby -> the 2D list
  { const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), rz = api.tc && api.tc.root && api.tc.root.querySelector('.kc-r'); let ts = null;
    const onDown = (e) => { if (e.button > 0) return; ts = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
    const onUp = (e) => { if (!ts || e.pointerId !== ts.id) return; const okTap = Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 12 && performance.now() - ts.t < 400; ts = null;
      if (!okTap || !inside || !ib || !ib.bdMesh || P.z - RZ <= 4.2 || !api.cam || !api.view) return; const cv = api.view.querySelector('canvas') || api.view, r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, api.cam); const hit = ray.intersectObject(ib.bdMesh, false)[0]; if (hit && hit.distance < 40) timesPanel(); };
    if (rz) { rz.addEventListener('pointerdown', onDown); rz.addEventListener('pointerup', onUp); cleanup.push(() => { rz.removeEventListener('pointerdown', onDown); rz.removeEventListener('pointerup', onUp); }); } }
  // ---------------------------------------------------------------- owner editor (lazy module, owner only)
  let editP = null, editMod = null;
  async function openEdit(zone) { if (!owner) return; closePanels(); if (!editMod) editMod = await import('./theater-edit.js'); editP = editMod.openTheaterEditor({ api, K, P, uid, getSt: () => st, sv, items, setItems, save, transport, songs, songAt, playing, applyLights, movieCmd, movieInfo: () => ({ sh: show(), title: MOVIE.title, slots: program(false).map((q) => ({ i: q.i, title: slotTitle(q.ids), at: q.o })) }), manualLights, zoneHere, close: closePanels, refresh: () => { applyOutside(); applyLights(); }, OX, OZ, RX, RZ }); }
  function paintEdit() { if (editP && editP.repaint) editP.repaint(); }
  const zoneHere = () => (!inside ? 'lo' : P.z - RZ > 4.2 ? 'li' : 'la');
  // ---------------------------------------------------------------- NPC sims (pooled, cheap AI near the player only)
  const npc = attachTheaterNpcs(api, W, K, { T, RX, RZ, OX, OZ, IN, FLAT, lobbySeats: () => decSeats.li, isInside: () => inside, snackMenu, ticket: () => { emote('🎟️'); K.say('🎟️ Here is your ticket! Entry is free today. Enjoy the show!'); }, nowShowing: () => { const s = songAt(st.pl.i); return playing() && s ? s.title || s.key : ''; }, movieLine, emote, closePanels });
  cleanup.push(() => npc.destroy());
  // ---------------------------------------------------------------- subscribe + owner check
  if (uid) {
    unsub = onSnapshot(ref, (snap) => { if (owner && (saving || Date.now() - lastLocal < 1500)) return; const prevLi = st.li, prevLa = st.la, prevLo = st.lo; st = sanitize(snap.exists() ? snap.data() : null);
      if (st.lo !== prevLo) rebuildDecor('lo'); if (ib && st.li !== prevLi) rebuildDecor('li'); if (ib && st.la !== prevLa) rebuildDecor('la'); applyOutside(); applyLights(); syncAudio(); paintEdit(); }, () => { /* offline / signed out: defaults */ });
    isUnlimited(uid).then((v) => { owner = !!v; paintHud(); }).catch(() => {});
  }
  rebuildDecor('lo'); applyOutside(); { const [a, b] = marqText(); drawMarq(a, b); }
  // ---------------------------------------------------------------- per frame
  let extT = 0, extLoaded = false, crT = 0; let bulbT = 0, bulbStep = 0, autoT = 0, fadeAt = 0, marqT = 0, bdT = 0, artT = 0; const bc = new THREE.Color(), bd = new THREE.Color(); const hp = new THREE.Vector3();
  function update(dt, now) {
    const dx = P.x - (T.x0 + T.x1) / 2, dz = P.z - (T.z0 + T.z1) / 2, nearOut = !inside && dx * dx + dz * dz < 160 * 160;
    if (nearOut && (bulbT -= dt) <= 0) { bulbT = 0.28; bulbStep++; bc.set(sv('oMarq')).lerp(bd.set('#fff8dc'), 0.55); bd.set(sv('oMarq')).multiplyScalar(0.3); for (let i = 0; i < ex.bulbN; i++) ex.bulbs.setColorAt(i, (i + bulbStep) % 3 ? bc : bd); ex.bulbs.instanceColor.needsUpdate = true; }
    const s = songAt(st.pl.i); if ((marqT -= dt) <= 0) { marqT = 0.5; const [a, b] = marqText(); drawMarq(a, b); }
    if ((artT -= dt) <= 0) { artT = 2; swapArt(); }
    // facade poster cases: textures load the first time you come near; plates (title + next show) redraw every 2 s while near
    if (nearOut && dx * dx + dz * dz < 120 * 120 && (extT -= dt) <= 0) { extT = 2; if (!extLoaded) { extLoaded = true; loadExtPosters(THREE, ex.extPosters); } drawPlates(list(), ex.extPosters); } // age / profile changed (e.g. signed in): swap the feature poster
    if (inside && ib) {
      if (Math.abs(lvl - lvlT) > 0.002 || lvlT !== targetLevel()) { lvlT = targetLevel(); const tw = performance.now(), fdt = Math.min(0.5, Math.max(dt, (tw - (fadeAt || tw)) / 1000)); fadeAt = tw; lvl += (lvlT - lvl) * Math.min(1, fdt / 0.8); if (Math.abs(lvl - lvlT) < 0.003) lvl = lvlT; applyLights(); } else fadeAt = 0;
      drawScreen(now); if ((autoT -= dt) <= 0) { autoT = 0.5; syncAudio(); hush.tick(); }
      const sh = show(), aud = P.z - RZ <= 4.2; if (movie) movie.update(playing() ? null : sh, aud, dt);
      if (!aud && (nsT -= dt) <= 0) { nsT = 1; drawNowShowing(ib.nsCv.getContext('2d'), ib.nsCv.width, ib.nsCv.height, sh); ib.nsTex.needsUpdate = true; } // lobby stand, once a second
      if (!aud && (bdT -= dt) <= 0) { bdT = 1; const L = list(); drawBoard(ib.bdCv.getContext('2d'), ib.bdCv.width, ib.bdCv.height, L, Date.now()); ib.bdTex.needsUpdate = true; drawPlates(L); } // showtimes board + poster plates
      if ((seatChk -= dt) <= 0) { seatChk = 0.2; const nb = P.sit ? null : findSeat(); if (nb !== seatNear) seatNear = nb; }
      // owner client advances the playlist when a song ends
      if (owner && st.pl.on && s && pos() > durNow(s) + 2.5 && Date.now() - st.pl.at > 4000) { if (songs().length > 1) transport('next'); else transport('stop'); }
    } else if ((seatChk -= dt) <= 0) { seatChk = 0.3; seatNear = !P.sit && Math.hypot(P.x - OX, P.z - OZ) < 30 ? findSeat() : null; }
    if (held && heldSpr) { const me = api.me; if (me) { hp.set(P.x + Math.sin(P.yaw) * 0.38, P.y + 0.8, P.z + Math.cos(P.yaw) * 0.38); heldSpr.position.copy(hp); } if (Date.now() - (P.eAt || 0) > 5000) { P.e = held.e; P.eAt = Date.now(); api.markDirty && api.markDirty(); } }
    { const tc = performance.now(); if (tc - crT > 400) { crT = tc; paintCredit(); } } // wall clock: dt is capped at low fps
    npc.update(dt, now);
  }
  function prompt() {
    if (inside) {
      if (P.z - RZ > 20.3 && Math.abs(P.x - RX) < 3.2) return { id: 'th-out', label: '🚪 Leave Lone Keem Studio' };
      const n = npc.nearest(); if (n) return { id: 'th-npc', label: `💬 Talk to ${n.name}` };
      if (P.sit && P.sit.th) return null;
      if (seatNear) return { id: 'th-sit', label: '🪑 Sit' };
      const lz = P.z - RZ; if (lz > 9.9 && lz < 11.6 && P.x - RX > ib.SN.x0 - 0.5 && P.x - RX < ib.SN.x1 + 0.5) return { id: 'th-snack', label: '🍿 Buy snacks (⭐ Star Coins)' };
      if (lz > 11.6 && lz < 13 && P.x - RX > 12) return { id: 'th-times', label: '🕒 Showtimes' };
      if (lz > 9.9 && lz < 11.6 && P.x - RX > ib.TK.x0 - 0.5 && P.x - RX < ib.TK.x1 + 0.5) return { id: 'th-ticket', label: '🎟️ Get a free ticket' };
      return null;
    }
    if (roomState.inId) return null;
    if (P.x < 392 && Math.hypot(P.x - T.door[0], P.z - T.door[1]) < 3.6) return { id: 'th-in', label: '🎬 Enter Lone Keem Studio' };
    const n = npc.nearest(); if (n) return { id: 'th-npc', label: `💬 Talk to ${n.name}` };
    if (seatNear && !P.sit) return { id: 'th-sit', label: '🪑 Sit' };
    if (owner && P.x < 392 && Math.hypot(P.x - T.door[0], P.z - T.door[1]) < 14) return { id: 'th-edit', label: '🎨 Edit theater outside' };
    return null;
  }
  function action(a) {
    if (a === 'th-in') enter(); else if (a === 'th-out') leave(); else if (a === 'th-sit') { const s = findSeat(); if (s) sitAt(s); }
    else if (a === 'th-snack') snackMenu(); else if (a === 'th-times') timesPanel(); else if (a === 'th-ticket') { emote('🎟️'); K.say('🎟️ Here is your ticket! Entry is free today. Enjoy the show!'); }
    else if (a === 'th-npc') { const n = npc.nearest(); if (n) npc.talk(n); } else if (a === 'th-edit') openEdit();
  }
  window.__theaterDbg = { get st() { return st; }, get ex() { return ex; }, get hush() { return hush; }, get inside() { return inside; }, get owner() { return owner; }, set owner(v) { if (LOCAL) { owner = !!v; paintHud(); } }, get ib() { return ib; }, transport, movieCmd, show, list, kid, timesPanel, creditsPanel, drawPlates, marq: () => marqText(), line: () => movieLine(), boardXY() { if (!ib || !ib.bdMesh || !api.cam || !api.view) return null; const v = new THREE.Vector3(); ib.bdMesh.getWorldPosition(v); v.project(api.cam); const r = (api.view.querySelector("canvas") || api.view).getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, z: v.z }; }, get movie() { return movie; }, enter, leave, sitAt, findSeat, openEdit, snackMenu, closePanels, npc, get lvl() { return lvl; },
    standUp: () => standUp(), seats: () => allSeats().map((q) => ({ x: q.x - RX, z: q.z - RZ, y: q.y })),
    tp(lx, lz, cy) { if (!LOCAL || !inside) return; P.x = RX + lx; P.z = RZ + lz; P.y = FLAT + yIn(lx, lz); P.vy = 0; P.onGround = true; if (cy != null) try { window.__p3.setYaw(cy); } catch { /* */ } } };
  return {
    prompt, action, update,
    destroy() { try { leave(true); } catch { /* */ } if (unsub) unsub(); clearTimeout(saveT); for (const f of cleanup) try { f(); } catch { /* */ }
      for (const c of ex.cols) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } for (const b of odBoxes) { const i = api.box.indexOf(b); if (i >= 0) api.box.splice(i, 1); }
      extG.removeFromParent(); odG.removeFromParent(); inG && inG.removeFromParent(); heldSpr && heldSpr.removeFromParent(); hudEl.remove(); crEl.remove(); document.body.classList.remove('th-pnl', 'th-cardup'); hush.leave(); if (audio) { audio.pause(); audio.src = ''; } if (movie) { movie.dispose(); movie = null; } if (far) far.visible = true; }
  };
}
