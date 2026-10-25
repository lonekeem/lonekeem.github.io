// Real-time housemates. Loaded only after you walk through a door (homes.js imports this then).
// One Firestore doc per player: houseHere/{plot}/who/{uid}. The outdoor park room is not used,
// so two players in the same house see each other even when Pal Park put them in different rooms.
// Movement writes wait 110ms (rules reject anything inside 90ms) and only while someone else is here.
// Alone, the join doc is removed after a few seconds so an empty house does not keep writing.
// A hidden tab or a closed page deletes the doc; everyone else drops the avatar within 8 seconds.
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { FLAT } from './layout.js';
import { clean, checkInput } from '../pals/talk.js';
import { getActivePal } from '../pals/core.js';

export const HOUSE_CAP = 12;
export const MOVE_GAP_MS = 110;
export const HEARTBEAT_MS = 3000;
export const STALE_MS = 8000;
export const ALONE_MS = 5000;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function palBits(p) {
  const s = p || {};
  let outfit = s.outfit && typeof s.outfit === 'object' ? s.outfit : {};
  let colors = s.colors && typeof s.colors === 'object' ? s.colors : {};
  try {
    if (JSON.stringify(outfit).length > 500) outfit = {};
    if (JSON.stringify(colors).length > 300) colors = {};
  } catch { outfit = {}; colors = {}; }
  return {
    species: String(s.species || 'kemy').slice(0, 16) || 'kemy',
    name: String(s.name || 'Pal').slice(0, 24),
    colors,
    pattern: String(s.pattern || '').slice(0, 16),
    acc: String(s.acc || '').slice(0, 24),
    outfit,
    level: clamp((s.level | 0) || 1, 1, 40),
    variant: String(s.variant || '').slice(0, 16)
  };
}

// Centimetres from the room centre, height above the floor, facing in degrees.
export function packPose(P, cx, cz) {
  const yaw = Number.isFinite(P.yaw) ? P.yaw : 0;
  const dance = P.dance && Date.now() < (P.danceUntil || 0) ? String(P.dance).slice(0, 20) : '';
  const sitting = !!(P.sit || dance === 'sit');
  let a = 'i';
  if (sitting) a = 's';
  else if (P._sp > 2.6) a = 'r';
  else if (P._sp > 0.35) a = 'w';
  return {
    x: clamp(Math.round((P.x - cx) * 100), -1200, 1200),
    z: clamp(Math.round((P.z - cz) * 100), -1200, 1200),
    y: clamp(Math.round(((Number.isFinite(P.y) ? P.y : FLAT) - FLAT) * 100), 0, 900),
    f: ((Math.round(yaw * 180 / Math.PI) % 360) + 360) % 360,
    a,
    dn: sitting ? (dance || 'sit') : dance,
    e: P.e && Date.now() - (P.eAt || 0) < 6000 ? String(P.e).slice(0, 12) : '',
    s: String(P.say || '').slice(0, 60),
    sa: Math.max(0, P.sayAt | 0)
  };
}

function worldOf(d, cx, cz) {
  return { x: cx + (d.x || 0) / 100, z: cz + (d.z || 0) / 100, y: FLAT + (d.y || 0) / 100, yaw: ((d.f || 0) * Math.PI) / 180 };
}

function logLine(name, text) {
  const log = document.getElementById('p3-log');
  if (!log || !text) return;
  const d = document.createElement('div');
  d.className = 'p3-msg';
  const b = document.createElement('b');
  b.textContent = name + ': ';
  d.append(b, document.createTextNode(text));
  log.appendChild(d);
  while (log.children.length > 30) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

export function startHouseParty(opt) {
  const { db, uid, plot, cx, cz, P, S, others, say, onFull, quietPark, dropPal } = opt;
  const ref = doc(db, 'houseHere', plot, 'who', uid);
  const state = { plot, n: 0, writes: 0, err: '', full: false, stopped: false };
  let pal = null;
  let unsub = null;
  let timer = 0;
  let writing = false;
  let dirty = true;
  let docLive = false;
  let joinSent = false;
  let sawMate = false;
  let joinedAt = 0;
  let aloneSince = 0;
  let nextOk = 0;
  let lastSend = 0;
  let lastSig = '';
  let lastX = P.x;
  let lastZ = P.z;
  let lastMoveAt = performance.now();
  let booted = false;
  let denyN = 0;
  const names = new Map();
  const muted = new Set(JSON.parse((() => { try { return localStorage.getItem('kemy-park-muted-' + uid) || '[]'; } catch { return '[]'; } })()));
  const blocked = (S && S.blocked) || new Set();
  window.__houseMates = state;
  if (quietPark) quietPark();

  function profile() {
    const p = S && S.profile;
    return p && p.displayName && p.username ? p : null;
  }
  function body() {
    const pose = packPose(P, cx, cz);
    const me = profile();
    return {
      ...pose,
      n: me.displayName,
      u: me.username,
      p: palBits(pal),
      at: serverTimestamp()
    };
  }
  function sigOf(b) {
    return [b.x, b.z, b.y, b.f, b.a, b.dn, b.e, b.s, b.sa, b.p.species, b.p.level, JSON.stringify(b.p.colors), JSON.stringify(b.p.outfit)].join('|');
  }
  async function removeDoc() {
    docLive = false;
    try { await deleteDoc(ref); } catch { /* already gone */ }
  }
  async function write(force) {
    if (state.stopped || state.full || writing || !profile()) return;
    const now = Date.now();
    if (!force && now < nextOk) return;
    const b = body();
    const sig = sigOf(b);
    if (!force && sig === lastSig && now - lastSend < HEARTBEAT_MS) { dirty = false; return; }
    writing = true;
    lastSend = now;
    try {
      await setDoc(ref, b);
      docLive = true;
      denyN = 0;
      state.writes++;
      state.err = '';
      lastSig = sig;
      dirty = false;
      nextOk = Date.now() + MOVE_GAP_MS;
      if (!joinedAt) joinedAt = Date.now();
    } catch (e) {
      state.err = (e && e.code) || 'write';
      console.warn('house here', state.err, e && e.message);
      dirty = true;
      nextOk = Date.now() + 500;
      if (e && e.code === 'permission-denied' && ++denyN >= 3) {
        state.stopped = true;
        say && say('Could not share your spot in this house');
      }
    }
    writing = false;
  }
  function forget(id) {
    names.delete(id);
    if (dropPal) dropPal(id);
    else others.delete(id);
  }
  function place(id, d, at) {
    if (blocked.has(id)) { forget(id); return; }
    const w = worldOf(d, cx, cz);
    let o = others.get(id);
    const fresh = !o;
    if (!o) {
      o = { uid: id, house: true, x: w.x, z: w.z, ix: w.x, iz: w.z, ivx: 0, ivz: 0, iyaw: w.yaw, dl: 110, fade: 0, y: w.y, yaw: w.yaw, seenS: 0, t: Math.random() * 100, buf: [] };
      others.set(id, o);
    }
    o.house = true;
    const B = o.buf || (o.buf = []);
    if (!B.length || at > B[B.length - 1].t) {
      const st = B.length >= 4 ? B.shift() : {};
      const prev = B.length ? B[B.length - 1] : null;
      st.t = at; st.x = w.x; st.z = w.z; st.yaw = w.yaw; st.vx = 0; st.vz = 0;
      if (prev) {
        const sec = Math.max(0.05, (at - prev.t) / 1000);
        st.vx = (w.x - prev.x) / sec;
        st.vz = (w.z - prev.z) / sec;
        prev.vx = st.vx; prev.vz = st.vz;
      }
      B.push(st);
    }
    if (o.th != null && Math.abs(o.th - w.y) > 1.4) o.y = w.y;
    const off = Date.now() - at;
    o.off = o.off == null ? off : Math.min(off, o.off + (off - o.off) * 0.1);
    const said = String(d.s || '');
    const show = said && !checkInput(said) && !muted.has(id) ? clean(said).slice(0, 60) : '';
    if (show && d.sa && d.sa !== o.seenS) { o.seenS = d.sa; logLine(d.n || 'Pal', show); }
    Object.assign(o, {
      tx: w.x, tz: w.z, th: w.y, tr: w.yaw, dn: typeof d.dn === 'string' ? d.dn : '',
      an: d.a === 'r' ? 'run' : d.a === 'w' ? 'walk' : d.a === 's' ? 'sit' : 'idle',
      name: d.n || 'Pal', uname: d.u || '', pal: d.p || o.pal, at,
      say: show, sayAt: d.sa || 0, e: d.e || ''
    });
    if (fresh && booted && d.n) say && say(d.n + ' came in');
    names.set(id, d.n || 'Pal');
  }
  function onSnap(qs) {
    if (state.stopped) return;
    const now = Date.now();
    const fresh = [];
    qs.forEach((d) => {
      const at = d.data().at && d.data().at.toMillis ? d.data().at.toMillis() : now;
      if (now - at < STALE_MS) fresh.push({ id: d.id, at });
    });
    fresh.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const mine = fresh.findIndex((x) => x.id === uid);
    if (fresh.length > HOUSE_CAP && (mine < 0 || mine >= HOUSE_CAP)) {
      state.full = true;
      state.stopped = true;
      removeDoc();
      onFull && onFull();
      return;
    }
    const ids = new Set();
    let mates = 0;
    qs.forEach((d) => {
      if (d.id === uid) return;
      const data = d.data();
      const at = data.at && data.at.toMillis ? data.at.toMillis() : 0;
      if (!at || now - at > STALE_MS) {
        if (at && now - at > STALE_MS) deleteDoc(d.ref).catch(() => {});
        if (names.has(d.id)) { const nm = names.get(d.id); forget(d.id); if (booted) say && say(nm + ' left'); }
        return;
      }
      ids.add(d.id);
      mates++;
      place(d.id, data, at);
    });
    for (const id of [...names.keys()]) if (!ids.has(id)) { const nm = names.get(id); forget(id); if (booted) say && say(nm + ' left'); }
    state.n = mates;
    if (!booted) {
      booted = true;
      if (mates > 0) say && say(mates === 1 ? '1 Pal is here with you' : mates + ' Pals are here with you');
    }
    if (mates > 0) { sawMate = true; aloneSince = now; dirty = true; }
    else if (!aloneSince) aloneSince = now;
  }
  function tick() {
    if (state.stopped) return;
    const nowP = performance.now();
    const dt = Math.max(0.016, (nowP - lastMoveAt) / 1000);
    const sp = Math.hypot(P.x - lastX, P.z - lastZ) / dt;
    P._sp = sp > 40 ? 0 : sp;
    lastX = P.x; lastZ = P.z; lastMoveAt = nowP;
    if (state.n > 0) {
      const pose = packPose(P, cx, cz);
      const key = [pose.x, pose.z, pose.y, pose.f, pose.a, pose.dn, pose.e, pose.s, pose.sa].join('|');
      if (key !== state.pose) { state.pose = key; dirty = true; }
      if (dirty || Date.now() - lastSend >= HEARTBEAT_MS) write(Date.now() - lastSend >= HEARTBEAT_MS);
      return;
    }
    if (!sawMate) {
      if (!docLive && !joinedAt) {
        if (!joinSent || Date.now() >= nextOk) { joinSent = true; write(true); }
      } else if (docLive && joinedAt && Date.now() - joinedAt > ALONE_MS) removeDoc();
    } else if (docLive && Date.now() - aloneSince > ALONE_MS) removeDoc();
  }
  const onPal = () => { getActivePal(db, uid).then((p) => { if (!state.stopped && p) { pal = p; dirty = true; } }).catch(() => {}); };
  addEventListener('kemy:pal-changed', onPal);
  onPal();
  const onHide = () => { if (document.hidden) removeDoc(); else if (!state.stopped) { joinSent = false; dirty = true; write(true); } };
  const onBye = () => { removeDoc(); };
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', onBye);
  try { unsub = onSnapshot(collection(db, 'houseHere', plot, 'who'), onSnap, (e) => { state.err = (e && e.code) || 'listen'; }); }
  catch (e) { state.err = 'listen'; }
  timer = setInterval(tick, 100);
  tick();
  function stop() {
    if (state.stopped && !unsub) return;
    state.stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    removeEventListener('pagehide', onBye);
    removeEventListener('kemy:pal-changed', onPal);
    if (unsub) { try { unsub(); } catch { /* */ } unsub = null; }
    for (const id of [...names.keys()]) forget(id);
    names.clear();
    state.n = 0;
    removeDoc();
    if (window.__houseMates === state) window.__houseMates = null;
  }
  return { stop, state };
}
