// Tap-to-star: a double-tap detector and the studio's star burst.
// The burst is a gold star with a purple glow that spins in at the exact tap point, a purple
// halo ring, and a few four-point sparkles flying out (not a heart pop).
const STAR_PATH = 'M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z';
const SPARK_PATH = 'M12 2c.6 4.6 2.8 7 7.6 7.6-4.8.6-7 3-7.6 7.6-.6-4.6-2.8-7-7.6-7.6C9.2 9 11.4 6.6 12 2z';

// Places a burst at client coordinates (x, y) inside `host` (must be position: relative/absolute).
export function burstStar(host, x, y, { size = 96 } = {}) {
  const r = host.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'tapburst'; b.setAttribute('aria-hidden', 'true');
  b.style.left = (x - r.left) + 'px'; b.style.top = (y - r.top) + 'px';
  b.style.setProperty('--ts', size + 'px');
  b.style.setProperty('--tr', (Math.random() * 30 - 15).toFixed(0) + 'deg');
  let sparks = '';
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = size * (0.62 + Math.random() * 0.3);
    sparks += `<svg class="tb-spark" viewBox="0 0 24 24" style="--sx:${(Math.cos(a) * d).toFixed(0)}px;--sy:${(Math.sin(a) * d).toFixed(0)}px;--sd:${(i * 25)}ms;--ss:${(10 + Math.random() * 10).toFixed(0)}px"><path d="${SPARK_PATH}"/></svg>`;
  }
  b.innerHTML = `<span class="tb-halo"></span><svg class="tb-star" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>${sparks}`;
  host.appendChild(b);
  setTimeout(() => b.remove(), 1000);
  return b;
}

// Calls `double(e)` for two taps within `ms` (and close together), otherwise `single(e)` after
// `ms`. With no `single`, nothing waits. `ignore(e)` skips taps on controls.
export function onDoubleTap(el, { single = null, double, ignore = null, ms = 250 } = {}) {
  let last = 0, lx = 0, ly = 0, timer = 0;
  el.addEventListener('click', (e) => {
    if (ignore && ignore(e)) return;
    const now = performance.now();
    const near = Math.abs(e.clientX - lx) < 48 && Math.abs(e.clientY - ly) < 48;
    if (now - last < ms && near) {
      clearTimeout(timer); timer = 0; last = 0;
      e.preventDefault(); e.stopPropagation();
      double(e);
      return;
    }
    last = now; lx = e.clientX; ly = e.clientY;
    if (single) {
      e.preventDefault(); e.stopPropagation();
      clearTimeout(timer);
      timer = setTimeout(() => { timer = 0; single(e); }, ms);
    }
  }, true);
  el.style.touchAction = 'manipulation';   // no double-tap zoom
}
