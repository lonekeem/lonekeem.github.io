// Landscape only while Pal Park or Kemy Street is open. Other screens stay free.
// Android (TWA / installed app) can lock. A normal browser often needs fullscreen first,
// and that has to start in the tap that opened the scene. iPhone Safari cannot lock:
// those phones get a small hint instead. Every failure is ignored.

export const WORLD_RE = /^#\/(?:park|street)$/;
export const isWorldHash = (h) => WORLD_RE.test(String(h || ''));
export const needsTurnHint = (lockable, portrait) => !lockable && !!portrait;
export const TURN_HINT = 'Turn your phone sideways for the best view';

const worldHref = (href) => {
  const s = String(href || '');
  const h = s.includes('#') ? s.slice(s.indexOf('#')) : s;
  return h === '#/park' || h === '#/street';
};

export function createWorldOrient(io) {
  let gen = 0;
  let weFs = false;
  let active = false;
  const fsNow = () => !!(io.fullscreenElement || io.webkitFullscreenElement);
  return {
    enter() {
      const token = ++gen;
      active = true;
      const run = async () => {
        try {
          const ori = io.orientation;
          if (!ori || typeof ori.lock !== 'function') return false;
          if (!fsNow() && io.requestFullscreen) {
            try { await io.requestFullscreen(); if (token === gen) weFs = fsNow(); }
            catch { if (token === gen) weFs = false; }
          }
          if (token !== gen) return false;
          try { await ori.lock('landscape'); }
          catch {
            if (token === gen && weFs && io.exitFullscreen) {
              try { await io.exitFullscreen(); } catch { /* */ }
              weFs = false;
            }
            return false;
          }
          // A newer enter owns the lock, or leave() already released it. Only the cancelled
          // attempt unlocks, and only when nothing newer is still holding the scene.
          if (token !== gen) {
            if (!active) {
              try { ori.unlock && ori.unlock(); } catch { /* */ }
              if (weFs && io.exitFullscreen) { try { await io.exitFullscreen(); } catch { /* */ } weFs = false; }
            }
            return false;
          }
          return true;
        } catch { return false; }
      };
      return run();
    },
    leave(hash) {
      if (isWorldHash(hash)) return { stayed: true, unlocked: false, exited: false };
      gen++;
      if (!active && !weFs) return { stayed: false, unlocked: false, exited: false };
      active = false;
      try { io.orientation && io.orientation.unlock && io.orientation.unlock(); } catch { /* */ }
      const exited = weFs;
      weFs = false;
      if (exited && io.exitFullscreen) {
        try { const p = io.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* */ }
      }
      return { stayed: false, unlocked: true, exited };
    },
    get heldFullscreen() { return weFs; }
  };
}

function liveIO() {
  return {
    get orientation() { try { return screen.orientation; } catch { return null; } },
    get fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement; },
    get webkitFullscreenElement() { return document.webkitFullscreenElement; },
    requestFullscreen() {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) return Promise.reject();
      return req.call(el);
    },
    exitFullscreen() {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) return Promise.resolve();
      return exit.call(document);
    }
  };
}

const live = createWorldOrient(liveIO());
export const enterWorldLandscape = () => live.enter();
export const leaveWorldLandscape = () => live.leave(location.hash || '');
export const orientationLockable = () => {
  try { return !!(screen.orientation && typeof screen.orientation.lock === 'function'); } catch { return false; }
};

let armed = false;
export function armWorldLandscape() {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && worldHref(a.getAttribute('href'))) enterWorldLandscape();
  }, true);
}

// Small portrait hint for phones that cannot lock. Tapping it dismisses it.
// Turning sideways hides it. It never covers the scene.
export function bindWorldTurnHint(el) {
  if (!el) return () => {};
  let dismissed = false;
  const portrait = () => { try { return innerHeight > innerWidth; } catch { return false; } };
  const paint = () => {
    if (!el.isConnected) return;
    el.hidden = dismissed || orientationLockable() || !portrait();
  };
  el.onclick = () => { dismissed = true; el.hidden = true; };
  addEventListener('resize', paint);
  addEventListener('orientationchange', paint);
  paint();
  return () => {
    removeEventListener('resize', paint);
    removeEventListener('orientationchange', paint);
    el.hidden = true;
  };
}
