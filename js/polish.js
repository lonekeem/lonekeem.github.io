// UI polish runtime: page-enter animation, list fade-ins, card tilt, and the effects toggle.
const KEY = 'kemy-fx';
export const fxOn = () => { const v = localStorage.getItem(KEY); if (v) return v === '1'; const n = navigator; return !((n.deviceMemory && n.deviceMemory < 4) || (n.hardwareConcurrency && n.hardwareConcurrency < 4) || (n.connection && n.connection.saveData)); };
export const setFx = (on) => { localStorage.setItem(KEY, on ? '1' : '0'); apply(); };
function apply() { document.documentElement.classList.toggle('no-fx', !fxOn()); }
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function initPolish() {
  apply(); const main = document.getElementById('main'); if (!main) return;
  let last = location.hash; addEventListener('hashchange', () => { last = location.hash; if (RM()) return; main.classList.remove('k-enter'); void main.offsetWidth; main.classList.add('k-enter'); setTimeout(() => main.classList.remove('k-enter'), 600); });
  // fade list items in as they scroll into view (cheap: one observer, once per element)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('k-fade'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -20px 0px' });
    const seen = new WeakSet(); const scan = () => { if (RM()) return; main.querySelectorAll('.post, .gtile, .lb-row, .list-item, .pcard').forEach((el) => { if (!seen.has(el)) { seen.add(el); io.observe(el); } }); };
    new MutationObserver(() => requestAnimationFrame(scan)).observe(main, { childList: true, subtree: true }); scan();
  }
  // subtle 3D tilt on hoverable tiles (fine pointers only, effects on)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    main.addEventListener('pointermove', (e) => { if (!fxOn() || RM()) return; const t = e.target.closest('.gtile, .pcard, .create-opt'); if (!t) return; const r = t.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; t.style.transform = `perspective(700px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-3px)`; });
    main.addEventListener('pointerout', (e) => { const t = e.target.closest && e.target.closest('.gtile, .pcard, .create-opt'); if (t && !t.contains(e.relatedTarget)) t.style.transform = ''; });
  }
}
